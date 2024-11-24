import openai from '../../config/openai';
import { compressBase64Image, isValidJSON, returnStreamData } from "../../utils/helperFunctions";

import { PartialUserIngredientResponse as PartialIngredient } from "../../interfaces";
import { getUserIngredientsByType } from "../data-access/ingredient.da";
import logger from '../../config/logger';
import { Response } from 'express';

/**
 * @module createCocktail.service
 * 
 * @description This module provides operations for creating a cocktail recipe
 * @note this service uses server sent events to stream data to the client. therefore, the response object is passed to the functions
 * 
 * @exports createCocktailOperations
 */

export const createCocktailOperations = {

    /**
     * @description This function creates a cocktail recipe using OpenAI API and returns a valid JSON with image.
     * @param {string} userId
     * @param {string} prompt
     * @returns {RecipeWithImage}
     */
    createCocktail: async (userId: string, prompt: string, res: Response): Promise<void> => {
        const ingredients = await getUserIngredientsByType(userId, 'drink');

        // Check if there are enough ingredients to create a recipe
        if (ingredients.length < 4) {
            throw new Error('Not enough ingredients to create a recipe');
        }

        const userIngredients = ingredients.map((ingredient: PartialIngredient) => ingredient.name) as string[];

        // Create a cocktail title using OpenAI API
        const title = await createCocktailOperations.createCocktailTitle(prompt, userIngredients);

        // Create the recipe and the recipe image using OpenAI API
        const [_recipe, imageUrl] = await Promise.all([
            createCocktailOperations.createCocktailOpenAI(prompt, userIngredients, title, res),
            createCocktailOperations.createImageOpenAI(title, userIngredients)
        ]);

        // Compress the image
        const base64Image = await compressBase64Image(imageUrl as string, 60); // 30 KB

        // Prepare the image data for the client
        const base64DataUrl = `data:image/jpeg;base64,${base64Image}`;

        // Stream the image
        return returnStreamData(res, { event: 'image', data: base64DataUrl });
    },

    /**
     * @description This function creates a cocktail recipe using OpenAI API and returns a valid JSON.
     * @param {string[]} userIngredients
     * @returns {Recipe} recipe
     */
    createCocktailOpenAI: async (prompt: string, userIngredients: string[], title: string, res: Response): Promise<void> => {
        const maxRetries = 3;
        let attempts = 0;
        let isValidJson = false;
        let recipe = null;

        while (attempts < maxRetries && !isValidJson) {
            try {
                const completion = await openai.chat.completions.create({
                    messages: [{
                        role: "user",
                        content: `
                            Create a ${title} cocktail recipe with these ingredients: ${userIngredients?.join(', ')}
                            Also, consider this prompt: ${prompt}.
                            Important: Use only the provided ingredients.
                            Don't use more than 5 ingredients.
                            Format in valid JSON without backticks:
                            {
                                "title": "Cocktail title",
                                "description": "Cocktail description",
                                "ingredients": [{"ingredient": "ingredient name and quantity"}],
                                "steps": [{"step": "step description", "time": "time to complete"}],
                                "level": "difficulty level",
                                "time": "total time",
                                "type": "cocktail" (exactly like this)
                            }
                        `
                    }],
                    model: "gpt-3.5-turbo",
                });

                const response = completion.choices[0].message.content as string;
                isValidJson = isValidJSON(response);

                if (isValidJson) {
                    recipe = JSON.parse(response);
                }
            } catch (error: any) {
                logger.error(error.message);
                attempts++;
            }
        }

        if (!isValidJson) {
            throw new Error('No valid JSON response generated');
        }

        return returnStreamData(res, { event: 'recipe', data: recipe });
    },

    /**
     * @description This function creates an image using OpenAI API.
     * @param {string} cocktailTitle
     * @param {string[]} userIngredients
     * @returns {string} valid base64 image
     */
    createImageOpenAI: async (cocktailTitle: string, userIngredients: string[]): Promise<string> => {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `A hyper-realistic photograph of a beautifully presented ${cocktailTitle} cocktail.
                the ingredients are: ${userIngredients?.join(', ')}.
                Don't show the ingredients in the image. just the cocktail!
                The drink should appear professionally crafted and served in a fitting glass, 
                with vibrant, natural colors and subtle reflections to make it look freshly prepared.
                Include visually stunning lighting, such as soft natural or studio lighting, 
                to enhance the textures and depth. The background should complement the drink 
                with a modern or elegant bar setting, but remain blurred to maintain focus 
                on the cocktail. Exclude any visible ingredients or text—just the cocktail itself, 
                as if photographed by a professional food photographer.`,
            n: 1,
            size: "1024x1024",
            quality: 'standard',
            style: 'vivid',
            response_format: 'b64_json',
        });

        const imageUrl = response.data[0].b64_json as string;

        return imageUrl;
    },

    /**
     * @description This function creates a cocktail title using OpenAI API.
     * @param prompt 
     * @param userIngredients
     * @returns {string} cocktailTitle
     */
    createCocktailTitle: async (prompt: string, userIngredients: string[]): Promise<string> => {
        const maxRetries = 3;
        let attempts = 0;
        let isValidJson = false;
        let cocktailTitle = null;

        while (attempts < maxRetries && !isValidJson) {
            try {
                const completion = await openai.chat.completions.create({
                    messages: [{
                        role: "user",
                        content: `
                            Generate a title for a cocktail using these ingredients: ${userIngredients?.join(', ')}
                            Also, consider this prompt: ${prompt}.
                            Format in valid JSON without backticks:
                            {
                                "title": "Cocktail title"
                            }
                        `
                    }],
                    model: "gpt-3.5-turbo",
                });

                const response = completion.choices[0].message.content as string;
                isValidJson = isValidJSON(response);

                if (isValidJson) {
                    cocktailTitle = JSON.parse(response).title;
                }
            } catch (error: any) {
                logger.error(error.message);
                attempts++;
            }
        }

        if (!isValidJson) {
            throw new Error('No valid JSON response generated');
        }

        return cocktailTitle;
    }
};
