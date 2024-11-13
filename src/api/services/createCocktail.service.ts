import openai from '../../config/openai';
import { compressBase64Image, isValidJSON, returnStreamData } from "../../utils/helperFunctions";

import { UserIngredientResponse, Recipe, RecipeWithImage } from "../../interfaces";
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
        let userIngredients: string[];

        const ingredients = await getUserIngredientsByType(userId, 'drink');

        // Check if there are enough ingredients to create a recipe
        if (ingredients.length < 4) {
            throw new Error('Not enough ingredients to create a recipe');
        }

        userIngredients = ingredients.map((ingredient: UserIngredientResponse) => ingredient.name);

        // Create a cocktail title using OpenAI API
        const title = await createCocktailOperations.createCocktailTitle(prompt, userIngredients);

        // Create the recipe and the recipe image using OpenAI API
        const [recipe, imageUrl] = await Promise.all([
            createCocktailOperations.createCocktailOpenAI(prompt, userIngredients, title, res),
            createCocktailOperations.createImageOpenAI(title, userIngredients)
        ]);

        // Compress the image
        const base64Image = await compressBase64Image(imageUrl as string, 60); // 30 KB

        // Prepare the image data for the client
        const base64DataUrl = `data:image/jpeg;base64,${base64Image}`;

        // Stream the image
        return returnStreamData({ event: 'image', data: base64DataUrl }, res);
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
                                "time": "total time"
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

        return returnStreamData({ event: 'recipe', data: recipe }, res);
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
            prompt: `A realistic photo of a ${cocktailTitle} cocktail with the following ingredients: ${userIngredients.join(', ')}
                IMPORTANT: Don't show the ingredients in the image. Show only a picture of the cocktail.`,
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
