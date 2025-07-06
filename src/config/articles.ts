export const ARTICLE_CATEGORIES = [
  "Email Security",
  "Privacy",
  "Authentication",
  "Digital Literacy",
  "Online Shopping",
  "Media Literacy",
] as const;

export const CATEGORY_COLORS = {
  "Email Security": "bg-red-100 text-red-800",
  "Privacy": "bg-blue-100 text-blue-800",
  "Authentication": "bg-green-100 text-green-800",
  "Digital Literacy": "bg-purple-100 text-purple-800",
  "Online Shopping": "bg-orange-100 text-orange-800",
  "Media Literacy": "bg-indigo-100 text-indigo-800"
} as const;

export type ArticleCategory = typeof ARTICLE_CATEGORIES[number]; 