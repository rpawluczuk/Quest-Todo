package pl.questtodo.reward;

import java.math.BigDecimal;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateRewardRequest(
        @NotBlank(message = "Podaj nazwę nagrody.")
        String title,
        @NotNull(message = "Koszt nagrody jest wymagany.")
        @Min(value = 1, message = "Minimalny koszt nagrody to 1 punkt.")
        @Max(value = Integer.MAX_VALUE, message = "Maksymalny koszt nagrody to 2147483647 punktów.")
        @Digits(integer = 10, fraction = 0, message = "Koszt musi być liczbą całkowitą.")
        BigDecimal cost
) {
}
