import fs from "fs";
import { spawn } from "child_process";
import path from "path";
import { Storage } from "@google-cloud/storage";

process.env.GOOGLE_APPLICATION_CREDENTIALS = "./service-account-key.json";

const OUTPUT_DIR_NAME = "converted";

const main = async () => {
  const [folder_dir, gcloud_bucket, gcloud_destination] = process.argv.slice(2);

  if (!folder_dir) {
    throw new Error("No directory set");
  }

  if (!gcloud_bucket) {
    throw new Error("No gcloud bucket set");
  }

  if (!gcloud_destination) {
    throw new Error("No gcloud destination set");
  }

  if (!fs.existsSync(folder_dir)) {
    throw new Error("Directory doesnt exist");
  }

  if (!fs.existsSync(`${folder_dir}/${OUTPUT_DIR_NAME}`)) {
    fs.mkdirSync(`${folder_dir}/${OUTPUT_DIR_NAME}`, {
      recursive: true,
    });
  }

  function removeSuffix(filename) {
    const lastIndex = filename.lastIndexOf(".");
    if (lastIndex !== -1) {
      return filename.slice(0, lastIndex);
    } else {
      return filename;
    }
  }

  const isFile = (file, directory) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    return stat.isFile();
  };

  const files = fs
    .readdirSync(folder_dir)
    .filter((file) => isFile(file, folder_dir))
    .filter((file) => {
      // dont convert files that already exist in the output directory
      return !fs.existsSync(
        `${folder_dir}/${OUTPUT_DIR_NAME}/${removeSuffix(file)}.mp4`
      );
    });

  const uploadToBucket = async () => {
    const storage = new Storage();

    const bucket = storage.bucket("videos-tb");

    const convertedFiles = fs
      .readdirSync(`${folder_dir}/converted`)
      .filter((file) => isFile(file, `${folder_dir}/${OUTPUT_DIR_NAME}`));

    for (let i = 0; i < convertedFiles.length; i++) {
      const file = convertedFiles[i];

      const [show, season, episode, episodeName] =
        removeSuffix(file).split("_");

      const fileSize = fs.statSync(
        `${folder_dir}/${OUTPUT_DIR_NAME}/${file}`
      ).size;

      console.log(
        `Starting upload of ${file} to ${gcloud_bucket}-${gcloud_destination}`
      );

      let prevProgress = null;

      await bucket.upload(`${folder_dir}/${OUTPUT_DIR_NAME}/${file}`, {
        destination: `${gcloud_destination}/${file}`,
        metadata: {
          show,
          season,
          episode,
          episodeName,
        },
        onUploadProgress: ({ bytesWritten, contentLength }) => {
          const currentProgess = Math.round((bytesWritten / fileSize) * 100);
          if (currentProgess !== prevProgress) {
            console.log(`Upload progress: ${currentProgess}%`);
            prevProgress = currentProgess;
          }
        },
      });

      console.log(
        `Finished uploading ${file} to ${gcloud_bucket}-${gcloud_destination}`
      );
    }
  };

  const convertFile = (fileIndex) => {
    if (fileIndex >= files.length) {
      console.log("All files converted");
      uploadToBucket().then(() => {
        console.log("All uploads complete");
      });
      return;
    }

    const file = files[fileIndex];
    const outputName = `${removeSuffix(file)}.mp4`;

    const startTime = performance.now();

    console.log(`Creating ffmpeg process for: ${file}`);

    // some of these parameters are required for for the video to run on safari
    // im not entirely sure which one it is but i believe video codec h264 and audio codec acc should work on safari
    // but -profile:v main was the change that got it to work
    // -pix_fmt yuv420p was required for the command to run
    // src: https://superuser.com/questions/1200080/ffmpeg-encoded-mp4-wont-play-in-safari-works-in-chrome-ff

    const ffmpegProcess = spawn("ffmpeg", [
      "-i",
      `${folder_dir}/${file}`,
      "-map_metadata",
      "-1",
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-profile:v",
      "main",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "-crf",
      "23",
      `${folder_dir}/${OUTPUT_DIR_NAME}/${outputName}`,
    ]);

    ffmpegProcess.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    ffmpegProcess.on("error", (error) => {
      console.error(`Error converting ${file}: ${error.message}`);
    });

    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        console.log(
          `Conversion of ${file} complete in ${performance.now() - startTime}ms`
        );
        convertFile(fileIndex + 1);
      } else {
        console.error(`Conversion of ${file} failed with code ${code}`);
      }
    });
  };

  convertFile(0);
};

main();
