package pl.questtodo.task;

import java.util.List;
import java.util.ArrayList;

import org.springframework.stereotype.Service;

@Service
public class TaskService {

    private final List<Task> tasks = new ArrayList<>(List.of(
            new Task(1, "Poświęcić 20 minut na naukę Reacta", 20, false, false),
            new Task(2, "Wybrać się na spacer", 15, false, false),
            new Task(3, "Przeczytać rozdział książki", 10, false, false)
    ));
    private long nextId = 4;

    public synchronized List<Task> getTasks() {
        return List.copyOf(tasks);
    }

    public synchronized Task createTask(String title, int points) {
        Task task = new Task(nextId++, title, points, false, false);
        tasks.add(task);
        return task;
    }
}
