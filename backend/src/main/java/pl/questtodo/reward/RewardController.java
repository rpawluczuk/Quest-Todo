package pl.questtodo.reward;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/rewards")
public class RewardController {
    private final RewardService rewardService;

    public RewardController(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @GetMapping
    public List<Reward> getRewards() {
        return rewardService.getRewards();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Reward createReward(@Valid @RequestBody CreateRewardRequest request) {
        return rewardService.createReward(request.title().strip(), request.cost().intValueExact());
    }

    @GetMapping("/purchases")
    public List<PurchaseEntity.Purchase> getPurchases() { 
        return rewardService.getPurchases(); 
    }

    @PostMapping("/{id}/purchases")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseEntity.Purchase buyReward(@PathVariable long id) { 
        return rewardService.buyReward(id); 
    }
}
