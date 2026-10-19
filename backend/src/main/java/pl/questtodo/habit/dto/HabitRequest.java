package pl.questtodo.habit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record HabitRequest(
        @NotBlank(message = "Podaj nazwę nawyku.")
        @Size(max = 120, message = "Nazwa nawyku może mieć maksymalnie 120 znaków.")
        String name,
        @Min(value = 1, message = "Wybierz od 1 do 7 dni w tygodniu.")
        @Max(value = 7, message = "Wybierz od 1 do 7 dni w tygodniu.")
        Integer targetDays,
        @Min(value = 0, message = "Punkty nie mogą być ujemne.")
        Integer rewardPoints,
        String description, java.time.LocalDate startDate, java.time.LocalDate endDate,
        @Min(value = 1, message = "Podaj co najmniej jedno wykonanie.") Integer completionLimit,
        @Positive(message = "Premia za zakończenie musi być dodatnia.") Integer completionBonusPoints,
        @Min(value = 1, message = "Wymagany procent musi wynosić od 1 do 100.")
        @Max(value = 100, message = "Wymagany procent musi wynosić od 1 do 100.") Integer requiredSuccessPercent,
        // In PUT requests, true replaces both bonus fields, including with null to clear them.
        Boolean replaceCompletionBonus,
        @Positive(message = "Identyfikator kategorii musi być dodatni.") Long categoryId,
        @Size(max = 100, message = "Możesz przypisać maksymalnie 100 celów.")
        List<@Positive Long> goalIds) {}
