package pl.questtodo.task.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;

/** Presence flags distinguish omitted fields from explicit JSON null. */
public class UpdateSubtaskRequest {
    private String title;
    private Boolean completed;
    private boolean titlePresent;
    private boolean completedPresent;

    @JsonSetter("title")
    public void setTitle(String title) { this.title = title; titlePresent = true; }

    @JsonSetter("completed")
    public void setCompleted(Boolean completed) { this.completed = completed; completedPresent = true; }

    public String getTitle() { return title; }
    public Boolean getCompleted() { return completed; }
    public boolean hasTitle() { return titlePresent; }
    public boolean hasCompleted() { return completedPresent; }

    @JsonIgnore
    @AssertTrue(message = "Podaj niepustą nazwę podzadania (maksymalnie 120 znaków).")
    public boolean isTitleValid() {
        return !titlePresent || (title != null && !title.isBlank() && title.length() <= 120);
    }

    @JsonIgnore
    @AssertTrue(message = "Pole completed nie może być null.")
    public boolean isCompletedValid() { return !completedPresent || completed != null; }
}
