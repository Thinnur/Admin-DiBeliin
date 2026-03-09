// =============================================================================
// DiBeliin Admin - Brand Logo Mapping
// =============================================================================
// Maps fast-food brand names to their public logo URLs.
// Keys are normalized to lowercase for case-insensitive matching.

export const BRAND_LOGO_MAP: Record<string, string> = {
    // Fast food international
    'mcd': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/200px-McDonald%27s_Golden_Arches.svg.png',
    'mcdonalds': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/200px-McDonald%27s_Golden_Arches.svg.png',
    'mcdonald\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/200px-McDonald%27s_Golden_Arches.svg.png',
    'kfc': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/200px-KFC_logo.svg.png',
    'kentucky': 'https://upload.wikimedia.org/wikipedia/en/thumb/b/bf/KFC_logo.svg/200px-KFC_logo.svg.png',
    'burger king': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Burger_King_logo_%281999%29.svg/200px-Burger_King_logo_%281999%29.svg.png',
    'burgerking': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Burger_King_logo_%281999%29.svg/200px-Burger_King_logo_%281999%29.svg.png',
    'pizza hut': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/Pizza_Hut_logo.svg/200px-Pizza_Hut_logo.svg.png',
    'pizzahut': 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/Pizza_Hut_logo.svg/200px-Pizza_Hut_logo.svg.png',
    'domino': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Domino%27s_pizza_logo.svg/200px-Domino%27s_pizza_logo.svg.png',
    'dominos': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Domino%27s_pizza_logo.svg/200px-Domino%27s_pizza_logo.svg.png',
    'domino\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Domino%27s_pizza_logo.svg/200px-Domino%27s_pizza_logo.svg.png',
    'subway': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Subway_2016_logo.svg/200px-Subway_2016_logo.svg.png',
    'a&w': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/A%26W_Restaurants_logo.svg/200px-A%26W_Restaurants_logo.svg.png',
    'aw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/A%26W_Restaurants_logo.svg/200px-A%26W_Restaurants_logo.svg.png',
    'wendy\'s': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Wendy%27s_full_logo_2012.svg/200px-Wendy%27s_full_logo_2012.svg.png',
    'wendys': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Wendy%27s_full_logo_2012.svg/200px-Wendy%27s_full_logo_2012.svg.png',
    'popeyes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Popeyes_logo.svg/200px-Popeyes_logo.svg.png',

    // Indonesian fast food & casual dining
    'hokben': 'https://hokben.co.id/img/logo.png',
    'hoka hoka bento': 'https://hokben.co.id/img/logo.png',
    'richeese': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Richeese_Factory_logo.svg/200px-Richeese_Factory_logo.svg.png',
    'richeese factory': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Richeese_Factory_logo.svg/200px-Richeese_Factory_logo.svg.png',
    'geprek bensu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Logo_Geprek_Bensu.png/200px-Logo_Geprek_Bensu.png',
    'bensu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Logo_Geprek_Bensu.png/200px-Logo_Geprek_Bensu.png',
    'solaria': 'https://upload.wikimedia.org/wikipedia/id/thumb/9/95/Logo_Solaria.png/200px-Logo_Solaria.png',
    'justus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Justus_Steakhouse_logo.png/200px-Justus_Steakhouse_logo.png',

    // Delivery / aggregator logos
    'gofood': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/GoFood_logo.svg/200px-GoFood_logo.svg.png',
    'grabfood': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/GrabFood_logo.svg/200px-GrabFood_logo.svg.png',
    'shopeefood': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/ShopeeFood_logo.svg/200px-ShopeeFood_logo.svg.png',
};

/**
 * Returns the logo URL for a given brand name, or null if not found.
 * Matching is case-insensitive and trims whitespace.
 */
export function getBrandLogo(brandName: string): string | null {
    if (!brandName) return null;
    const key = brandName.trim().toLowerCase();
    return BRAND_LOGO_MAP[key] ?? null;
}
