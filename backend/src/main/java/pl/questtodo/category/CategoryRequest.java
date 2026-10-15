package pl.questtodo.category;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @NotBlank(message = "Podaj nazwę kategorii.")
        @Size(max = 60, message = "Nazwa kategorii może mieć maksymalnie 60 znaków.")
        String name,
        @NotNull(message = "Wybierz ikonę kategorii.")
        CategoryIcon icon,
        @NotNull(message = "Wybierz kolor kategorii.")
        CategoryColor color) {}
