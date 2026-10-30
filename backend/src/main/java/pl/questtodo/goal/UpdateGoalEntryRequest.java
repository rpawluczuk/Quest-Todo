package pl.questtodo.goal;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.AssertTrue;

public class UpdateGoalEntryRequest {
    private GoalEntryType type;
    private String content;
    private boolean typePresent;
    private boolean contentPresent;

    @JsonSetter("type")
    public void setType(GoalEntryType type) { this.type = type; typePresent = true; }
    @JsonSetter("content")
    public void setContent(String content) { this.content = content; contentPresent = true; }

    public GoalEntryType getType() { return type; }
    public String getContent() { return content; }
    public boolean hasType() { return typePresent; }
    public boolean hasContent() { return contentPresent; }

    @JsonIgnore
    @AssertTrue(message = "Rodzaj wpisu nie może być null.")
    public boolean isTypeValid() { return !typePresent || type != null; }

    @JsonIgnore
    @AssertTrue(message = "Podaj niepustą treść wpisu (maksymalnie 5000 znaków).")
    public boolean isContentValid() {
        return !contentPresent || (content != null && !content.isBlank() && content.length() <= 5000);
    }
}
