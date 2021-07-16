import { Request, Response, Router } from 'express'
import auth from '../middleware/auth'
import Comment from '../entities/Comment'
import Post from '../entities/Post'
import User from '../entities/User'
import fs from 'fs'
import path from 'path'


import user from '../middleware/user'
import multer, { FileFilterCallback } from 'multer'
import { makeId } from '../util/helpers'

const getUserSubmissions = async (req: Request, res: Response) => {
  try {
    const user = await User.findOneOrFail({
      where: { username: req.params.username },
      select: ['username', 'createdAt'],
    })

    const posts = await Post.find({
      where: { user },
      relations: ['comments', 'votes', 'sub'],
    })

    const comments = await Comment.find({
      where: { user },
      relations: ['post'],
    })

    if (res.locals.user) {
      posts.forEach((p) => p.setUserVote(res.locals.user))
      comments.forEach((c) => c.setUserVote(res.locals.user))
    }

    let submissions: any[] = []
    posts.forEach((p) => submissions.push({ type: 'Post', ...p.toJSON() }))
    comments.forEach((c) =>
      submissions.push({ type: 'Comment', ...c.toJSON() })
    )

    submissions.sort((a, b) => {
      if (b.createdAt > a.createdAt) return 1
      if (b.createdAt < a.createdAt) return -1
      return 0
    })

    return res.json({ user, submissions })
  } catch (err) {
    console.log(err)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}


const upload = multer({
  storage: multer.diskStorage({
    destination: 'public/images/users',
    filename: (_, file, callback) => {
      const name = makeId(15)
      callback(null, name + path.extname(file.originalname)) // e.g. jh34gh2v4y + .png
    },
  }),
  fileFilter: (_, file: any, callback: FileFilterCallback) => {
    if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
      callback(null, true)
    } else {
      callback(new Error('Not an image'))
    }
  },
})


const uploadUserImage = async (req: Request, res: Response) => {
  const user: User = res.locals.user
  try {
    const type = req.body.type
    console.log(req.file)

    if (type !== 'image' && type !== 'banner') {
      fs.unlinkSync(req.file!.path)
      return res.status(400).json({ error: 'Invalid type' })
    }

    let oldImageUrn: string = ''
    if (type === 'image') {
      oldImageUrn = user.imageUrn ?? ''
      user.imageUrn = req.file!.filename
    } else if (type === 'banner') {
      oldImageUrn = user.bannerUrn ?? ''
      user.bannerUrn = req.file!.filename
    }
    await user.save()

    if (oldImageUrn !== '') {
      fs.unlinkSync(`public\\images\\users\\${oldImageUrn}`)
    }

    
    return res.json(user)
  } catch (err) {
    console.log(err)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}

const router = Router()

router.get('/:username', user, getUserSubmissions)

router.post(
  '/:name/image',
  user,
  auth,
  upload.single('file'),
  uploadUserImage
)
export default router
