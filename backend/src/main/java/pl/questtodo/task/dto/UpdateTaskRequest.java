package pl.questtodo.task.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record UpdateTaskRequest(
    @NotBlank (message = "Podaj nazwę zadania.")
    String title, 
    @NotNull  (message = "Punkty są wymagane.")
    @Min(value = 1, message = "Minimalna liczba punktów to 1.")
    @Max(value = 1000, message = "Maksymalna liczba punktów za zadanie to 1000.")
    @Digits(integer = 5, fraction = 0, message = "Punkty muszą być liczbą całkowitą.")
    BigDecimal points,
    String description,
    LocalDate dueDate,
    LocalTime dueTime,
    Boolean clearDueDate,
    @Positive(message = "Identyfikator kategorii musi być dodatni.")
    Long categoryId,
    Boolean clearCategory,
    @Size(max = 100, message = "Możesz przypisać maksymalnie 100 celów.")
    List<@Positive Long> goalIds) {
}
