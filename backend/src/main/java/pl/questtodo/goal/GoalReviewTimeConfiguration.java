package pl.questtodo.goal;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GoalReviewTimeConfiguration {
    public static final ZoneId ZONE = ZoneId.of("Europe/Warsaw");

    @Bean
    public Clock goalReviewClock() { return Clock.system(ZONE); }
}
