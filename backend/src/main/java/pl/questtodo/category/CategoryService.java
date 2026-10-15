package pl.questtodo.category;

import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import pl.questtodo.user.CurrentUserProvider;
import pl.questtodo.user.UserService;

@Service
@Transactional
public class CategoryService {
    private final CategoryRepository categories;
    private final UserService users;
    private final CurrentUserProvider currentUser;

    public CategoryService(CategoryRepository categories, UserService users, CurrentUserProvider currentUser) {
        this.categories = categories;
        this.users = users;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<Category> getCategories() {
        return categories.findByUserIdOrderByNameKeyAscIdAsc(currentUser.getUserId()).stream()
                .map(CategoryEntity::toCategory).toList();
    }

    @Transactional(readOnly = true)
    public Category getCategory(long id) {
        return findOwned(id).toCategory();
    }

    public Category createCategory(String name, CategoryIcon icon, CategoryColor color) {
        String cleanName = name.strip();
        String nameKey = nameKey(cleanName);
        long userId = currentUser.getUserId();
        ensureNameAvailable(userId, nameKey, null);
        try {
            return categories.saveAndFlush(new CategoryEntity(
                    cleanName, nameKey, icon, color, users.currentReference())).toCategory();
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    public Category updateCategory(long id, String name, CategoryIcon icon, CategoryColor color) {
        CategoryEntity category = findOwned(id);
        String cleanName = name.strip();
        String nameKey = nameKey(cleanName);
        ensureNameAvailable(currentUser.getUserId(), nameKey, id);
        category.update(cleanName, nameKey, icon, color);
        try {
            categories.flush();
            return category.toCategory();
        } catch (DataIntegrityViolationException exception) {
            throw duplicateName();
        }
    }

    public void deleteCategory(long id) {
        categories.delete(findOwned(id));
    }

    private CategoryEntity findOwned(long id) {
        return categories.findByIdAndUserId(id, currentUser.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Kategoria nie istnieje."));
    }

    private void ensureNameAvailable(long userId, String nameKey, Long ignoredId) {
        boolean duplicate = ignoredId == null
                ? categories.existsByUserIdAndNameKey(userId, nameKey)
                : categories.existsByUserIdAndNameKeyAndIdNot(userId, nameKey, ignoredId);
        if (duplicate) throw duplicateName();
    }

    private static String nameKey(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    private static ResponseStatusException duplicateName() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Kategoria o tej nazwie już istnieje.");
    }
}
