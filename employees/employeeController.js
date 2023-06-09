import sharp from 'sharp'
import {
  getAllEmployeeInfo,
  putEmployee,
  getEmployeeByID,
  getAllEmployeeInfoUnmarshalled,
} from './profileService.js'
import { uploadImageObject, downloadImage } from './photoService.js'
import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

import { pipeline } from 'stream/promises'

/**
 * Instantiate S3 client.
 */
const clientConfig = {
  region: 'us-east-1'
}
const s3client = new S3Client(clientConfig)

/**
 * GET handler for /employees. Displays all employees.
 * @param {*} req
 * @param {*} res
 */
export const getAllEmployees = async (req, res) => {
  const data = await getAllEmployeeInfo()
  if (data) {
    res.type('json').send(JSON.stringify(data, null, '\t'))
  } else {
    res.json({ message: 'No items to show' })
  }
}

/**
 * GET handler for /all. For sharing data with other microservices. 
 * @param {*} req
 * @param {*} res
 */
export const getUnmarshalledData = async (req, res) => {
  const data = await getAllEmployeeInfoUnmarshalled()
  if (data) {
    res.type('json').send(data)
  } else {
    res.json({ message: 'No items to show' })
  }
}

/**
 * GET handler for /employee/:id/profile.
 * @param {*} req
 * @param {*} res
 */
export const getEmployeeByIDHandler = async (req, res) => {
  const paramID = req.params[0]
  const response = await getEmployeeByID(paramID)

  if (response) {
    res.type('json').send(JSON.stringify(response, null, '\t'))
  } else {
    res.status(400).json({
      message: 'No item matching provided URL parameter ' + paramID + ' found.'
    })
  }
}

/**
 * POST handler for /employee/:id/profile.
 * @param {*} req
 * @param {*} res
 */
export const postEmployeeHandler = async (req, res) => {
  const paramID = req.params[0]

  if (paramID !== req.body.EmployeeID) {
    res
      .status(400)
      .json({ message: 'EmployeeID in path and body do not match' })
  } else {
    await putEmployee(req.body)
    res
      .status(201)
      .json({ message: 'POST for EmployeeID ' + paramID + ' successful.' })
  }
}

/**
 * GET handler for /employee/:id/photo.
 * @param {*} req
 * @param {*} res
 */
export const getPhotoHandler = async (req, res) => {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: req.params[0]
  }

  const command = new GetObjectCommand(params)
  const response = await s3client.send(command)
  const file = req.params[0] + '.jpg'

  
  const writePhoto = async (filename, fd) => {
    try {
      await pipeline(fd, fs.createWriteStream(filename))
    } catch (err) {
      console.error('Error writing photo', err)
    }
  }

  await writePhoto(file, response.Body)
  res.status(200).sendFile(path.resolve(file))
}

/**
 * POST handler for /employee/:id/photo.
 * @param {*} req form data with file. Key must be 'file'.
 * @param {*} res
 */
export const postPhotoHandler = async (req, res) => {
  if (!req.file || Object.keys(req.file).length === 0) {
    return res
      .status(400)
      .send('No files were uploaded. Make sure form data key is "file".')
  }
  const paramID = req.params[0]
  const fileBuffer = await sharp(req.file.buffer).toBuffer()

  try {
    await uploadImageObject(paramID, fileBuffer)
  } catch (err) {
    return res.status(500).json({ message: 'ERROR Posting Photo.' })
  }
  res.status(201).json({ message: 'POST for photo successful.' })
}

