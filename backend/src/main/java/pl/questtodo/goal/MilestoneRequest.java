package pl.questtodo.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MilestoneRequest(
        @NotBlank(message = "Podaj nazwę kamienia milowego.")
        @Size(max = 120, message = "Nazwa kamienia milowego może mieć maksymalnie 120 znaków.")
        String title) {}
