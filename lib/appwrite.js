import {Account, Avatars, Client, ID, Databases, Query, Storage} from 'react-native-appwrite';

export const appwriteconfig = {
    endpoint: 'https://cloud.appwrite.io/v1',
    platform: 'com.bms.aora',
    projectId: '668d4192001e0d67f951',
    databaseId: '668d449600232f72b8b6',
    userCollectionId: '668d44ef0004d3bc1418',
    videoCollectionId: '668d456c001646a9d44b',
    storageId: '668d502d00211057f5de'
}

const client = new Client();

client
    .setEndpoint(appwriteconfig.endpoint)
    .setProject(appwriteconfig.projectId) 
    .setPlatform(appwriteconfig.platform)
;

const account = new Account(client);
const avatars = new Avatars(client);
const databases = new Databases(client);
const storage = new Storage(client);

export const createUser = async (email, password, username) => {
    try {
       const newAccount = await account.create(
        ID.unique(),
        email,
        password,
        username
       );
       
       if(!newAccount) throw Error;

       const avatarUrl = avatars.getInitials(username);
       await signIn(email,password);
       const newUser = await databases.createDocument(
        appwriteconfig.databaseId,
        appwriteconfig.userCollectionId,
        ID.unique(),
        {
            accountid: newAccount.$id,
            email: email,
            username: username,
            avatar: avatarUrl,
        }
       );
       return newUser;
    } catch (error) {
        console.log(error);
        throw new Error(error);
    }
}

export const signIn = async (email, password) => {
    try {
        // Check if a session already exists by trying to get the current account
        try {
            const currentUser = await account.get();
            // If no error is thrown, a session already exists, so delete it
            await account.deleteSession('current');
        } catch (err) {
            // If an error is thrown, there is no existing session, so we can proceed
            if (err.code !== 401) {
                throw err; // Rethrow if it's not an unauthorized error
            }
        }

        // Create a new session
        const newSession = await account.createEmailPasswordSession(email, password);
        return newSession;
    } catch (error) {
        throw new Error(error.message);
    }
}

export const getCurrentUser = async () => {
    try {
        const currentAccount = await account.get();

        if(!currentAccount) throw Error;

        const currentUser = await databases.listDocuments(
            appwriteconfig.databaseId,
            appwriteconfig.userCollectionId,
            [Query.equal('accountid',currentAccount.$id)]
        )

        if(!currentUser) throw Error;

        return currentUser.documents[0];
    } catch (error) {
        console.log(error);
    }
}

export const getAllPosts = async () => {
    try {
       const posts = await databases.listDocuments(
            appwriteconfig.databaseId,
            appwriteconfig.videoCollectionId,
            [
                Query.orderDesc('$createdAt')
            ]  
       );

       return posts.documents;
    } catch (error) {
        throw new Error(error);
    }
}

export const getLatestPosts = async () => {
    try {
        const posts = await databases.listDocuments(
            appwriteconfig.databaseId,
            appwriteconfig.videoCollectionId,
            [
                Query.orderDesc('$createdAt'),
                Query.limit(7)
            ]
        );

        return posts.documents;
    } catch (error) {
        console.error("Failed to fetch latest posts:", error); // Log the error for debugging
        throw new Error("Failed to fetch latest posts");
    }
};

export const searchPosts = async (query) => {
    try {
        const posts = await databases.listDocuments(
            appwriteconfig.databaseId,
            appwriteconfig.videoCollectionId,
            [Query.search('title',query)]
        );

        return posts.documents;
    } catch (error) {
        console.error("Failed to fetch latest posts:", error); // Log the error for debugging
        throw new Error("Failed to fetch latest posts");
    }
};

export const getUserPosts = async (userId) => {
    try {
        const posts = await databases.listDocuments(
        appwriteconfig.databaseId,
        appwriteconfig.videoCollectionId,
        [Query.equal("creator", userId),Query.orderDesc('$createdAt')]
    );

        return posts.documents;
    } catch (error) {
        console.error("Failed to fetch latest posts:", error); // Log the error for debugging
        throw new Error("Failed to fetch latest posts");
    }
};


export const signOut = async() => {
    try {
      const session = await account.deleteSession("current");
  
      return session;
    } catch (error) {
      throw new Error(error);
    }
}

export const getFilePreview = async (fileId, type) => {
    let fileUrl;

    try {
        if (type === "video") {
            fileUrl = storage.getFileView(appwriteconfig.storageId, fileId);
        } else if (type === "image") {
            fileUrl = storage.getFilePreview(appwriteconfig.storageId, fileId, 2000, 2000, "top", 100);
        } else {
            throw new Error('Invalid file type');
        }

        if (!fileUrl) throw new Error('File URL generation failed');

        console.log(`Generated file URL: ${fileUrl}`); // Log the URL for debugging

        // Optional: Verify if the URL is accessible by making a HEAD request
        const response = await fetch(fileUrl, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`Failed to access the file at ${fileUrl}, status: ${response.status}`);
        }

        return fileUrl;
    } catch (error) {
        console.error(`Error in getFilePreview: ${error.message}`);
        throw new Error(error.message);
    }
};

export const uploadFile = async (file, type) => {
    if (!file) return;

    const { mimeType, ...rest } = file;
    const asset = {
        name: file.fileName,
        type: file.mimeType,
        size: file.fileSize,
        uri: file.uri,
    };

    try {
        const uploadFile = await storage.createFile(
            appwriteconfig.storageId,
            ID.unique(),
            asset
        );

        console.log(`File uploaded: ${uploadFile.$id}`); // Log the file ID for debugging

        // Ensure the correct file ID is passed to getFilePreview
        const fileUrl = await getFilePreview(uploadFile.$id, type);
        return fileUrl;
    } catch (error) {
        console.error(`Error in uploadFile: ${error.message}`);
        throw new Error(error.message);
    }
};
export const createVideo = async (form) => {
    try {
       const [thumbnailUrl, videoUrl] = await Promise.all([
        uploadFile(form.thumbnail , 'image'),
        uploadFile(form.video , 'video'),
       ])

       const newPost = await databases.createDocument(
        appwriteconfig.databaseId,appwriteconfig.videoCollectionId,ID.unique(),
        {
            title: form.title,
            thumbnail: thumbnailUrl,
            video: videoUrl,
            prompt: form.prompt,
            creator: form.userId
        }
       )

       return newPost;
    } catch (error) {
        throw new Error(error);
    }
}
