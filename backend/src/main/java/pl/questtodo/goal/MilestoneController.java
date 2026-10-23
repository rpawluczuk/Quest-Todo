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
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Milestone create(@PathVariable long goalId, @Valid @RequestBody MilestoneRequest request) {
        return milestones.create(goalId, request.title());
    }
}
