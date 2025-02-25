import { base64ToArrayBuffer, hashString } from "../../utils/helperFunctions";
import firebaseStorageOperations from "./firebase.service";

import MessageResponse from "../../interfaces/MessageResponse";
import { RecipeWithImage } from "../../interfaces";
import { getUserPageRecipesProps } from "../../interfaces/ServiceInterfaces";
import { addRecipeDB, deleteRecipeDB, getAllRecipesDB, getRecipeDB, getRecipesPageDB } from "../data-access/recipe.da";
import { RecipeDocument } from "../models/recipe.model";

/**
 * @module recipes.service
 * 
 * @description This module provides operations for getting, adding and deleting recipes
 * @exports recipeOperations
 */

const recipeOperations = {

    /**
     * @description Get a page of recipes from the database. If there is a query, get recipes by query
     * @param props 
     * @returns {RecipeDocument[]} 
     */
    getUserPageRecipes: async (props: getUserPageRecipesProps): Promise<RecipeDocument[]> => {
        const recipes = await getRecipesPageDB(props)

        return recipes
    },

    getAllUserRecipes: async (userId: string): Promise<RecipeDocument[]> => {
        const recipes = await getAllRecipesDB(userId)
        
        return recipes
    },

    /**
     * @description Converts the base64 image to an ArrayBuffer and uploads it to Firebase Storage and saves the link to it in the recipe to the DB
     * @param recipe
     * @returns {RecipeDocument}
     */
    addRecipe: async (recipe: RecipeWithImage): Promise<RecipeDocument> => {
        // Extract the base64 part
        const base64Image = recipe.image_url.replace(/^data:image\/(png|jpeg);base64,/, '');

        // Convert base64 to ArrayBuffer
        const imageBuffer = base64ToArrayBuffer(base64Image);

        const image_url = await firebaseStorageOperations.uploadImage(imageBuffer, recipe.recipe.id);

        const newRecipe = await addRecipeDB({ ...recipe, image_url } as RecipeDocument)

        return newRecipe
    },

    deleteRecipe: async (recipeId: string): Promise<MessageResponse> => {
        const recipe = await getRecipeDB(recipeId)        

        if (!recipe) {
            throw new Error('Recipe not found')
        }

        await Promise.all([
            firebaseStorageOperations.deleteImage(recipe.recipe.id),
            deleteRecipeDB(recipeId)
        ]);

        return { message: 'Recipe deleted successfully' }
    },

    getRecipe: async (recipeId: string): Promise<RecipeDocument> => {
        const recipe = await getRecipeDB(recipeId)

        if (!recipe) {
            throw new Error('Recipe not found')
        }

        return recipe
    },
}

export default recipeOperations
