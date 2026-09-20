package pl.questtodo.task;

import java.math.BigDecimal;

public record CreateTaskRequest(String title, BigDecimal points) {
}
