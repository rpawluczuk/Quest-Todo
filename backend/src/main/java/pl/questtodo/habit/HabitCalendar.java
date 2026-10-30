package pl.questtodo.habit;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

@Component
public class HabitCalendar {
    public static final ZoneId ZONE = ZoneId.of("Europe/Warsaw");
    public java.time.Instant now() { return java.time.Instant.now(); }
    public LocalDate today() {
        return LocalDate.now(ZONE);
    }
}
