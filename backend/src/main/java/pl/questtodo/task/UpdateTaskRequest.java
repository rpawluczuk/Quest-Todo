package pl.questtodo.task;

import java.math.BigDecimal;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateTaskRequest(
    @NotBlank (message = "Podaj nazwę zadania.")
    String title, 
    @NotNull  (message = "Punkty są wymagane.")
    @Min(value = 1, message = "Minimalna liczba punktów to 1.")
    @Max(value = 1000, message = "Maksymalna liczba punktów za zadanie to 1000.")
    @Digits(integer = 5, fraction = 0, message = "Punkty muszą być liczbą całkowitą.")
    BigDecimal points) {
}
