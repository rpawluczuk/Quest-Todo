package pl.questtodo.habit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;

public record HabitRequest(
        @NotBlank(message = "Podaj nazwę nawyku.")
        @Size(max = 120, message = "Nazwa nawyku może mieć maksymalnie 120 znaków.")
        String name,
        @Min(value = 1, message = "Wybierz od 1 do 7 dni w tygodniu.")
        @Max(value = 7, message = "Wybierz od 1 do 7 dni w tygodniu.")
        Integer targetDays,
        @Min(value = 0, message = "Punkty nie mogą być ujemne.")
        Integer rewardPoints) {}
