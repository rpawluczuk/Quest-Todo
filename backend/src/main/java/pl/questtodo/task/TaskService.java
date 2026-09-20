package pl.questtodo.task;

import java.util.List;
import java.util.ArrayList;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

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

    public synchronized Task updateCompletion(long id, boolean completed) {
        int index = findTaskIndex(id);
        Task task = tasks.get(index);
        Task updated = new Task(id, task.title(), task.points(), completed, task.inFocus());
        tasks.set(index, updated);
        return updated;
    }

    public synchronized Task updateFocus(long id, boolean inFocus) {
        int index = findTaskIndex(id);
        Task task = tasks.get(index);
        Task updated = new Task(id, task.title(), task.points(), task.completed(), inFocus);
        tasks.set(index, updated);
        return updated;
    }

    private int findTaskIndex(long id) {
        for (int index = 0; index < tasks.size(); index++) {
            if (tasks.get(index).id() == id) return index;
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje.");
    }

    public synchronized Task updateTask(long id, String title, int points) {
        for (int index = 0; index < tasks.size(); index++) {
            Task task = tasks.get(index);
            if (task.id() == id) {
                if (task.completed()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Nie można edytować wykonanego zadania.");
                }
                Task updatedTask = new Task(id, title, points, task.completed(), task.inFocus());
                tasks.set(index, updatedTask);
                return updatedTask;
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Zadanie nie istnieje.");
    }
}
