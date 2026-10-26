package pl.questtodo.task.dto;

import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ReorderSubtasksRequest(
        @NotNull(message = "Podaj kolejność podzadań.") List<@NotNull @Positive Long> subtaskIds) {}
