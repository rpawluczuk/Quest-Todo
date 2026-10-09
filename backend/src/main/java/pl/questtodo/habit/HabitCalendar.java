package pl.questtodo.habit;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public class HabitCalendar {
    public java.time.Instant now() { return java.time.Instant.now(); }
    public LocalDate today() {
        return LocalDate.now(ZoneId.of("Europe/Warsaw"));
    }
}
