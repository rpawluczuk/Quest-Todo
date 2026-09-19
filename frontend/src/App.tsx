import './App.css'

const tasks = [
  { id: 1, title: 'Poświęcić 20 minut na naukę Reacta', points: 20 },
  { id: 2, title: 'Wybrać się na spacer', points: 15 },
  { id: 3, title: 'Przeczytać rozdział książki', points: 10 },
]

function App() {
  return (
    <main className="quest-app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Małe kroki, codzienne zwycięstwa</p>
          <h1>Quest Todo</h1>
          <p className="subtitle">Zrób miejsce na to, co ważne.</p>
        </div>
        <div className="points-balance">
          <span>Twoje saldo</span>
          <strong>0 punktów</strong>
        </div>
      </header>

      <section className="today-section" aria-labelledby="today-heading">
        <div className="section-header">
          <h2 id="today-heading" lang="en">Today</h2>
          <p>Twoje zadania na dziś</p>
        </div>
        <ul className="task-list">
          {tasks.map((task) => (
            <li className="task" key={task.id}>
              <span className="task-title">{task.title}</span>
              <span className="task-points">{task.points} pkt</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
