ALTER TABLE categories DROP CONSTRAINT categories_icon_valid;

ALTER TABLE categories ADD CONSTRAINT categories_icon_valid CHECK (icon IN (
    'HEART', 'BRIEFCASE', 'HOME', 'BOOK', 'DUMBBELL',
    'WALLET', 'PEOPLE', 'STAR', 'LEAF', 'RUNNING',
    'UTENSILS', 'PLANE', 'MUSIC', 'PALETTE', 'CODE',
    'MOON', 'SUN', 'CAR', 'SHOPPING_CART', 'OTHER'
));
