package pl.questtodo.task;

import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TaskPriorityService {
    private final TaskRepository tasks;

    public TaskPriorityService(TaskRepository tasks) { this.tasks = tasks; }

    public LocalDate today() { return LocalDate.now(ZoneId.of("Europe/Warsaw")); }

    public void promoteForUser(long userId) {
        tasks.promoteDueTasks(userId, today().plusDays(7));
    }

    public void promote(TaskEntity task) { task.promoteIfDue(today().plusDays(7)); }

    @Scheduled(cron = "0 0 0 * * *", zone = "Europe/Warsaw")
    public void promoteDueTasks() {
        tasks.promoteAllDueTasks(today().plusDays(7));
    }
}
