package pl.questtodo.category;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import pl.questtodo.user.UserEntity;

@Entity
@Table(name = "categories")
public class CategoryEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "name_key", nullable = false, length = 60)
    private String nameKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CategoryIcon icon;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CategoryColor color;

    protected CategoryEntity() {}

    public CategoryEntity(String name, String nameKey, CategoryIcon icon, CategoryColor color, UserEntity user) {
        this.name = name;
        this.nameKey = nameKey;
        this.icon = icon;
        this.color = color;
        this.user = user;
    }

    public void update(String name, String nameKey, CategoryIcon icon, CategoryColor color) {
        this.name = name;
        this.nameKey = nameKey;
        this.icon = icon;
        this.color = color;
    }

    public Category toCategory() {
        return new Category(id, name, icon, color);
    }
}
