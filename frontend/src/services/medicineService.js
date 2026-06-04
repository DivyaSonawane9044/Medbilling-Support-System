import { productsAPI } from "./api";

export const getAllMedicines = () => productsAPI.getAll();
export const addMedicine = (data) => productsAPI.create(data);
