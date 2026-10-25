package pl.questtodo.task.dto;

public record SubtaskResponse(long id, String title, boolean completed, int position) {}
