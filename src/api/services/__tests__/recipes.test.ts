import recipeOperations from '../../services/recipes.service';
import firebaseStorageOperations from '../firebase.service';
import { RecipeDocument } from '../../models/recipe.model';
import { mockRecipe } from '../../../lib/mock/mockData';
import { base64ToArrayBuffer, hashString } from '../../../utils/helperFunctions';
import MessageResponse from '../../../interfaces/MessageResponse';
import { addRecipeDB, deleteRecipeDB, getRecipeDB, getRecipesDB } from '../../data-access/recipe.da';

jest.mock('../../data-access/recipe.da');
jest.mock('../firebase.service');
jest.mock('../../../utils/helperFunctions');

describe('recipeOperations', () => {

    describe('getUserRecipes', () => {
        it('should return the correct recipes for a given user ID', async () => {
            const mockRecipes: RecipeDocument[] = [
                { ...mockRecipe, userId: 'recipeId', createdAt: new Date() } as RecipeDocument
            ];
            (getRecipesDB as jest.Mock).mockResolvedValue(mockRecipes);

            const result = await recipeOperations.getUserRecipes('userId');

            expect(result).toEqual(mockRecipes);
        });
    });

    describe('addRecipe', () => {
        it('should add a new recipe and return the added recipe', async () => {
            
            const mockImageBuffer = new ArrayBuffer(8);
            const mockImageUrl = 'mockImageUrl';

            (base64ToArrayBuffer as jest.Mock).mockReturnValue(mockImageBuffer);
            (hashString as jest.Mock).mockReturnValue('hashedDescription');
            (firebaseStorageOperations.uploadImage as jest.Mock).mockResolvedValue(mockImageUrl);
            (addRecipeDB as jest.Mock).mockResolvedValue(mockRecipe);

            const result = await recipeOperations.addRecipe(mockRecipe);

            expect(result).toEqual(mockRecipe);
            expect(base64ToArrayBuffer).toHaveBeenCalledWith(mockRecipe.image_url.replace(/^data:image\/(png|jpeg);base64,/, ''));
            expect(hashString).toHaveBeenCalledWith(mockRecipe.recipe.description);
            expect(firebaseStorageOperations.uploadImage).toHaveBeenCalledWith(mockImageBuffer, 'hashedDescription');
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
            expect(firebaseStorageOperations.deleteImage).toHaveBeenCalledWith(hashString(mockRecipe.recipe.description));
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
