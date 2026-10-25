package pl.questtodo.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSubtaskRequest(
        @NotBlank(message = "Podaj nazwę podzadania.")
        @Size(max = 120, message = "Nazwa podzadania może mieć maksymalnie 120 znaków.")
        String title) {}
