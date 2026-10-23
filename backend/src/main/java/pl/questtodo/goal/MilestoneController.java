package pl.questtodo.goal;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/goals/{goalId}/milestones")
public class MilestoneController {
    private final MilestoneService milestones;
    public MilestoneController(MilestoneService milestones) { this.milestones = milestones; }
    @GetMapping
    public List<Milestone> list(@PathVariable long goalId) { return milestones.list(goalId); }
    @PatchMapping("/{milestoneId}")
    public Milestone rename(@PathVariable long goalId, @PathVariable long milestoneId,
            @Valid @RequestBody MilestoneRequest request) {
        return milestones.rename(goalId, milestoneId, request.title());
    }
    @DeleteMapping("/{milestoneId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long goalId, @PathVariable long milestoneId) {
        milestones.delete(goalId, milestoneId);
    }
    @PatchMapping("/{milestoneId}/completion")
    public Milestone setCompleted(@PathVariable long goalId, @PathVariable long milestoneId,
            @Valid @RequestBody MilestoneCompletionRequest request) {
        return milestones.setCompleted(goalId, milestoneId, request.completed());
    }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Milestone create(@PathVariable long goalId, @Valid @RequestBody MilestoneRequest request) {
        return milestones.create(goalId, request.title());
    }
}
