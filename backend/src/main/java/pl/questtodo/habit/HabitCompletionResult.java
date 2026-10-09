package pl.questtodo.habit;

public record HabitCompletionResult(Habit habit, Long balance, HabitAwardEntity.Award award) {}
