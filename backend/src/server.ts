import app from './app'
import { connectDB } from './db/mongoose'

const port = process.env.PORT || 4000

connectDB()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on http://localhost:${port}`)
    })
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', err)
    process.exit(1)
  })
