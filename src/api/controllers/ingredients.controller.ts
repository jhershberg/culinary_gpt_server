import { Response, Request, NextFunction } from 'express';
import { FilterQuery } from 'mongoose';
import { z } from 'zod';
import { HttpStatusCode } from 'axios';

import CustomRequest from '../../interfaces/CustomRequest';
import { IngredientType } from '../../interfaces';

import ingredientOperations from '../services/ingredients.service';
import { IngredientDocument } from '../models/ingredient.model';
import { HttpError } from '../../lib/HttpError';
import logger from '../../config/logger';
import imageDetectionOperations from '../services/imageDetection.service';

/**
 * @openapi
 * /user/ingredients/suggestions/{category}:
 *  get:
 *     tags:
 *     - Ingredients
 *     summary: Retrieves ingredient suggestions based on the specified category
 *     description: Fetches a list of ingredients that belong to the specified category.
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         description: The category of ingredients to query
 *         schema:
 *           type: string
 *           enum: [common, vegetables, dairy, spices, carbs, meat]
 *     responses:
 *       200:
 *         description: Successfully retrieved ingredients for the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ingredient'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */

export const ingredientSuggestionsSchema = z.object({
    params: z.object({
        category: z.enum(['common', 'vegetables', 'dairy', 'spices', 'carbs', 'meat', 'spirits', 'liqueurs', 'bitters', 'mixers', 'syrups', 'fruits', 'herbs']),
    }),
});

export const ingredientSuggestions = async (req: Request, res: Response<IngredientDocument[]>, next: NextFunction) => {
    const { category } = req.params;

    try {
        const result = await ingredientOperations.getByCategory(category as string);

        return res.json(result);
    } catch (error) {
        if (error instanceof Error) {
            logger.error(error.message);
        }
        next(new HttpError(
            HttpStatusCode.InternalServerError,
            'An error accrued while fetching ingredients'
        ));
    }
}

/**
 * @openapi
 * /api/ingredients/search:
 *  get:
 *     tags:
 *     - Ingredients
 *     summary: Queries ingredients by substring
 *     description: Fetches a list of ingredients that contain the specified substring in their name.
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: The substring to search for in ingredient names
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         required: true
 *         description: The type of ingredient (food or drink)
 *         schema:
 *           type: string
 *           enum: 
 *             - food
 *             - drink
 *     responses:
 *       200:
 *         description: Successfully retrieved matching ingredients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ingredient'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */

export const searchIngredientsSchema = z.object({
    query: z.object({
        query: z.string(),
        type: z.enum(['food', 'drink']),
    })
});

export const searchIngredients = async (req: CustomRequest, res: Response<IngredientDocument[]>, next: NextFunction) => {
    const { query, type } = req.query;

    try {
        const ingredients = await ingredientOperations.search(
            query as FilterQuery<IngredientDocument>,
            type as IngredientType
        );

        return res.json(ingredients);
    } catch (error) {
        if (error instanceof Error) {
            logger.error(error.message);
        }
        next(new HttpError(
            HttpStatusCode.InternalServerError,
            'An error accrued while searching ingredients'
        ));
    }
};

export const imageIngredientDetectorSchema = z.object({
    body: z.object({
        imageUrl: z.string()
    })
});

export const imageIngredientDetector = async (req: CustomRequest, res: Response<IngredientDocument[]>, next: NextFunction): Promise<void> => {
    try {
        const { imageUrl } = req.body;

        const ingredients = await imageDetectionOperations.getIngredientsFromImage(imageUrl);

        res.status(HttpStatusCode.Ok).json(ingredients);
    } catch (error) {
        logger.error(error);
        next(new HttpError(HttpStatusCode.InternalServerError, 'Failed to analyze image'));
    }
};