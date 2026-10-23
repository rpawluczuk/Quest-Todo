package pl.questtodo.goal;

import java.util.List;
import jakarta.validation.constraints.NotNull;

public record MilestoneOrderRequest(@NotNull List<@NotNull Long> milestoneIds) {}
