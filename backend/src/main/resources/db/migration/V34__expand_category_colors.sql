ALTER TABLE categories DROP CONSTRAINT categories_color_valid;

ALTER TABLE categories ADD CONSTRAINT categories_color_valid CHECK (color IN (
    'RED', 'ORANGE', 'AMBER', 'YELLOW', 'LIME',
    'GREEN', 'EMERALD', 'TEAL', 'CYAN', 'SKY',
    'BLUE', 'INDIGO', 'PURPLE', 'VIOLET', 'FUCHSIA',
    'PINK', 'ROSE', 'BROWN', 'SLATE', 'GRAY'
));
