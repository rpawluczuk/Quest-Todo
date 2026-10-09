package pl.questtodo.habit;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public class HabitCalendar {
    public LocalDate today() {
        return LocalDate.now(ZoneId.of("Europe/Warsaw"));
    }
}
