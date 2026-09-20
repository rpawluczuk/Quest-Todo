package pl.questtodo.task;

import java.math.BigDecimal;

public record UpdateTaskRequest(String title, BigDecimal points) {
}
