package pl.questtodo.task;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class TaskService {

    private final List<Task> tasks = List.of(
            new Task(1, "Poświęcić 20 minut na naukę Reacta", 20, false, false),
            new Task(2, "Wybrać się na spacer", 15, false, false),
            new Task(3, "Przeczytać rozdział książki", 10, false, false)
    );

    public List<Task> getTasks() {
        return tasks;
    }
}
