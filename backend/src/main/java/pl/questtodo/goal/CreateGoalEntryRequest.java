package pl.questtodo.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateGoalEntryRequest {
    @NotNull(message = "Podaj rodzaj wpisu.")
    private GoalEntryType type = GoalEntryType.NOTE;

    @NotBlank(message = "Wpisz treść wpisu.")
    @Size(max = 5000, message = "Wpis może mieć maksymalnie 5000 znaków.")
    private String content;

    public GoalEntryType getType() { return type; }
    public void setType(GoalEntryType type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
