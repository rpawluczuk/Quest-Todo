package pl.questtodo.goal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class GoalRequest {
    @NotBlank(message = "Podaj tytuł celu.")
    @Size(max = 120, message = "Tytuł celu może mieć maksymalnie 120 znaków.")
    private String title;
    @Size(max = 2000, message = "Stan początkowy może mieć maksymalnie 2000 znaków.")
    private String currentState;
    @Size(max = 2000, message = "Zamierzony efekt może mieć maksymalnie 2000 znaków.")
    private String desiredOutcome;
    private GoalReviewFrequency reviewFrequency;
    private boolean reviewFrequencyPresent;

    public String title() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String currentState() { return currentState; }
    public void setCurrentState(String value) { currentState = value; }
    public String desiredOutcome() { return desiredOutcome; }
    public void setDesiredOutcome(String value) { desiredOutcome = value; }
    public GoalReviewFrequency reviewFrequency() { return reviewFrequency; }
    public boolean hasReviewFrequency() { return reviewFrequencyPresent; }
    public void setReviewFrequency(GoalReviewFrequency value) {
        reviewFrequency = value;
        reviewFrequencyPresent = true;
    }
}
