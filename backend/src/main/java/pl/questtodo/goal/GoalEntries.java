package pl.questtodo.goal;

import java.util.List;

public record GoalEntries(List<GoalEntryResponse> entries, boolean hasMore, long totalElements) {}
