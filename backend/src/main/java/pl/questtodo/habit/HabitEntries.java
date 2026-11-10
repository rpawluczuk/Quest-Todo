package pl.questtodo.habit;

import java.util.List;

public record HabitEntries(List<HabitEntryResponse> entries, boolean hasMore, long totalElements) {}
