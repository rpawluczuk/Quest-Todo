package pl.questtodo.email;

public interface EmailDelivery {
    void send(String recipient, String subject, String text, String messageId);
}
