import recipeOperations from '../../services/recipes.service';
import firebaseStorageOperations from '../firebase.service';
import { RecipeDocument } from '../../models/recipe.model';
import { mockRecipe } from '../../../lib/mock/mockData';
import { base64ToArrayBuffer, hashString } from '../../../utils/helperFunctions';
import MessageResponse from '../../../interfaces/MessageResponse';
import { addRecipeDB, deleteRecipeDB, getRecipeDB, getAllRecipesDB, getRecipesPageDB } from '../../data-access/recipe.da';
import { userId } from '../../../lib/mock/mockApp';

jest.mock('../../data-access/recipe.da');
jest.mock('../firebase.service');
jest.mock('../../../utils/helperFunctions');

describe('recipeOperations', () => {

    describe('getUserPageRecipes', () => {
        it('should return the correct recipes for a given user ID', async () => {
            const mockRecipes: RecipeDocument[] = [
                { ...mockRecipe, userId, createdAt: new Date() } as RecipeDocument
            ];
            (getRecipesPageDB as jest.Mock).mockResolvedValueOnce(mockRecipes);

            const result = await recipeOperations.getUserPageRecipes({
                userId,
                page: 1,
                limit: 10,
                filter: 'recipes'
            });

            expect(result).toEqual(mockRecipes);
        });
    });

    describe('getAllUserRecipes', () => {
        it('should return the all recipes for a given user ID', async () => {
            const mockRecipes: RecipeDocument[] = [
                { ...mockRecipe, userId: 'recipeId', createdAt: new Date() } as RecipeDocument
            ];
            (getAllRecipesDB as jest.Mock).mockResolvedValue(mockRecipes);

            const result = await recipeOperations.getAllUserRecipes('userId');

            expect(result).toEqual(mockRecipes);
        });
    });

    describe('addRecipe', () => {
        it('should add a new recipe and return the added recipe', async () => {

            const mockImageBuffer = new ArrayBuffer(8);
            const mockImageUrl = 'mockImageUrl';

            (base64ToArrayBuffer as jest.Mock).mockReturnValue(mockImageBuffer);
            (firebaseStorageOperations.uploadImage as jest.Mock).mockResolvedValue(mockImageUrl);
            (addRecipeDB as jest.Mock).mockResolvedValue(mockRecipe);

            const result = await recipeOperations.addRecipe(mockRecipe);

            expect(result).toEqual(mockRecipe);
            expect(base64ToArrayBuffer).toHaveBeenCalledWith(mockRecipe.image_url.replace(/^data:image\/(png|jpeg);base64,/, ''));
            expect(firebaseStorageOperations.uploadImage).toHaveBeenCalledWith(mockImageBuffer, 'recipe123');
            expect(addRecipeDB).toHaveBeenCalledWith({ ...mockRecipe, image_url: mockImageUrl });
        });
    });

    describe('deleteRecipe', () => {
        it('should delete the recipe and its associated image from storage', async () => {

            (getRecipeDB as jest.Mock).mockResolvedValue(mockRecipe);
            (firebaseStorageOperations.deleteImage as jest.Mock).mockResolvedValue(undefined);
            (deleteRecipeDB as jest.Mock).mockResolvedValue(undefined);

            const result: MessageResponse = await recipeOperations.deleteRecipe('recipeId');

            expect(result).toEqual({ message: 'Recipe deleted successfully' });
            expect(getRecipeDB).toHaveBeenCalledWith('recipeId');
            expect(firebaseStorageOperations.deleteImage).toHaveBeenCalledWith(mockRecipe.recipe.id);
            expect(deleteRecipeDB).toHaveBeenCalledWith('recipeId');
        });
    });

    describe('getRecipe', () => {
        it('should return the correct recipe for a given recipe ID', async () => {

            (getRecipeDB as jest.Mock).mockResolvedValue(mockRecipe);

            const result = await recipeOperations.getRecipe('recipeId');

            expect(result).toEqual(mockRecipe);
            expect(getRecipeDB).toHaveBeenCalledWith('recipeId');
        });
    });

});
