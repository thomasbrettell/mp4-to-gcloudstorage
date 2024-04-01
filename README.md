# MP4 -> Google Cloud Storage

This script will convert a directory of videos to .mp4 then upload them to a google cloud bucket.

The command will try to convert/upload all FILES in the specified directory

[ffmpeg](https://ffmpeg.org/) must be installed on your system

## Instructions

- Install ffmpeg on your system if you havent already
  - And node/npm
- Clone the repo
- Run `npm i` in directory
- Create a file in this directory called `service-account-key.json`
  - In this file should be the credentials for your google cloud project
- Run the script
  - See "Script instructions"

### Script instructions

The parameters for the script are:

1. directory of videos
2. gcloud bucket name
3. gcloud bucket destination

Example commands:

```bash
npm start D:directory_with_videos example_bucket_name "example/videos/put_files_here"
```

```bash
node path_to_script.js D:directory_with_videos example_bucket_name "example/videos/put_files_here
```

## Naming conventions

For the sake of setting metadata files should be name a certain way.

Underscores are used to seperate attributes of a file.

Order is important.

For example:

"Show Name_S1_E1_Episode Name.mp4" will result in:

```json
{
  "show": "Show Name",
  "season": "1",
  "episode": "1",
  "episodeName": "Episode Name"
}
```
