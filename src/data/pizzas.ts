export type ToppingKind =
  | "mozz"
  | "basil"
  | "salami"
  | "chilli"
  | "burrata"
  | "tomatoChunk"
  | "mushroom"
  | "oregano"
  | "garlic"
  | "thyme";

export interface PizzaDef {
  id: string;
  no: string;
  name: string;
  price: number;
  img: string;
  ingredients: string[];
  toppings: ToppingKind[];
  base: "sauce" | "white";
  desc: string;
  hand: string;
}

export const PIZZAS: PizzaDef[] = [
  {
    id: "marinara",
    no: "01",
    name: "MARINARA",
    price: 10,
    img: "https://image.qwenlm.ai/generated-images/0ce5f3b4-5420-4e4b-a508-764578a8612b/_result.png",
    ingredients: ["TOMATO", "GARLIC", "OREGANO", "EVOO"],
    toppings: ["oregano", "garlic"],
    base: "sauce",
    desc: "The oldest one in the room. No cheese, no fear, nowhere to hide.",
    hand: "Napoli, 1734",
  },
  {
    id: "margherita",
    no: "02",
    name: "MARGHERITA",
    price: 12,
    img: "https://image.qwenlm.ai/generated-images/846a547d-06e1-497b-90a6-d3b49eb62cf6/_result.png",
    ingredients: ["TOMATO", "MOZZARELLA", "BASIL", "EVOO"],
    toppings: ["mozz", "basil"],
    base: "sauce",
    desc: "The queen. Tomato, mozzarella, basil — don't overthink it.",
    hand: "the queen",
  },
  {
    id: "diavola",
    no: "03",
    name: "DIAVOLA",
    price: 15,
    img: "https://image.qwenlm.ai/generated-images/a4c7bac2-7800-40f2-b7b6-e475ffa4791e/_result.png",
    ingredients: ["TOMATO", "MOZZARELLA", "SPICY SALAMI", "CHILLI"],
    toppings: ["mozz", "salami", "chilli"],
    base: "sauce",
    desc: "Sweet for exactly two seconds. Then the devil shows up.",
    hand: "diavola = devil, obviously",
  },
  {
    id: "burrata",
    no: "04",
    name: "BURRATA",
    price: 17,
    img: "https://image.qwenlm.ai/generated-images/8ca1b838-639d-4ef2-bc85-4121e1505d6e/_result.png",
    ingredients: ["TOMATO", "BURRATA", "CHERRY TOMATO", "BASIL"],
    toppings: ["burrata", "tomatoChunk", "basil"],
    base: "sauce",
    desc: "Cut the middle. You know exactly why.",
    hand: "cut the middle",
  },
  {
    id: "funghi",
    no: "05",
    name: "FUNGHI",
    price: 16,
    img: "https://image.qwenlm.ai/generated-images/c7e5bb6f-f20e-4ee9-9e73-f3e5ca6a4992/_result.png",
    ingredients: ["MOZZARELLA", "MIXED MUSHROOMS", "THYME", "EVOO"],
    toppings: ["mozz", "mushroom", "thyme"],
    base: "white",
    desc: "Forest floor meets wood fire. Earthy, golden, gone in minutes.",
    hand: "forest floor",
  },
];

export interface IngredientMeta {
  id: string;
  name: string;
  lines: string[];
}

export const INGREDIENTS_META: Record<string, IngredientMeta> = {
  tomato: { id: "tomato", name: "TOMATO", lines: ["ACIDITY", "SWEETNESS"] },
  mozz: { id: "mozz", name: "MOZZARELLA", lines: ["MILK / FAT", "TEXTURE"] },
  basil: { id: "basil", name: "BASIL", lines: ["AROMA", "FRESHNESS"] },
  oil: { id: "oil", name: "OLIVE OIL", lines: ["GOLD", "FINISH"] },
  chilli: { id: "chilli", name: "CHILLI", lines: ["HEAT", "CHARACTER"] },
  mushroom: { id: "mushroom", name: "MUSHROOM", lines: ["EARTH", "DEPTH"] },
};

export interface MenuItem {
  name: string;
  price: number;
  note?: string;
}

export const SIDES: MenuItem[] = [
  { name: "CROCCHÈ DI PATATE", price: 5, note: "potato croquettes, fried twice" },
  { name: "FRITTI MISTI", price: 8, note: "whatever the fryer loves today" },
  { name: "INSALATA AMARA", price: 7, note: "bitter leaves, lemon, no apologies" },
];

export const DOLCI: MenuItem[] = [
  { name: "TIRAMISÙ", price: 7, note: "nonna's recipe, nonna's portion" },
  { name: "BABÀ AL RUM", price: 8, note: "soaked past the legal limit" },
  { name: "GELATO DEL GIORNO", price: 6, note: "ask. it changes with the weather" },
];

export const DRINKS: MenuItem[] = [
  { name: "VINO DELLA CASA", price: 6, note: "red, honest, by the glass" },
  { name: "BIRRA ARTIGIANALE", price: 7, note: "small brewery, big opinions" },
  { name: "AMARO", price: 8, note: "the digestive argument winner" },
  { name: "ACQUA FRIZZANTE", price: 3, note: "cold, loud, necessary" },
];

export const IMG = {
  room: "https://image.qwenlm.ai/generated-images/7c2a92c0-91f4-4d9b-b8ca-9c2ef7acbe55/_result.png",
  counter: "https://image.qwenlm.ai/generated-images/8acb0e68-39a3-48da-8afe-35260a77e0e1/_result.png",
  table: "https://image.qwenlm.ai/generated-images/d1ac5f3a-2c97-4357-a28f-c7accc959bd7/_result.png",
  street: "https://image.qwenlm.ai/generated-images/1a84901d-e83d-4773-b8f7-f1cd4cd3eb7d/_result.png",
};

export const formatPrice = (n: number) => `€${n}`;
